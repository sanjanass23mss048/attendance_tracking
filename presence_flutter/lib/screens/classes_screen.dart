import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';

import '../state/auth_state.dart';
import '../theme.dart';

class ClassesScreen extends StatefulWidget {
  const ClassesScreen({super.key});

  @override
  State<ClassesScreen> createState() => _ClassesScreenState();
}

class _ClassesScreenState extends State<ClassesScreen> {
  List<dynamic> classes = [];
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
      final list = await context.read<AuthState>().api.classes();
      setState(() => classes = list);
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
          const Text('Your assigned classes',
              style: TextStyle(fontWeight: FontWeight.w700, fontSize: 16)),
          if (error != null) ...[
            const SizedBox(height: 8),
            Text(error!, style: const TextStyle(color: PresenceColors.danger)),
          ],
          const SizedBox(height: 12),
          if (loading)
            const Center(child: CircularProgressIndicator())
          else
            ...classes.map((c) {
              final m = Map<String, dynamic>.from(c as Map);
              final sections = (m['sections'] as List? ?? []);
              return Card(
                margin: const EdgeInsets.only(bottom: 10),
                child: ExpansionTile(
                  title: Text('Class ${m['name']}', style: const TextStyle(fontWeight: FontWeight.w700)),
                  subtitle: Text('${sections.length} section(s)'),
                  children: [
                    for (final s in sections)
                      ListTile(
                        title: Text('Section ${(s as Map)['name']}'),
                        subtitle: Text('${s['studentCount'] ?? 0} students'),
                        trailing: const Icon(Icons.fact_check_outlined),
                        onTap: () => context.push(
                          '/attendance/mark'
                          '?sectionId=${Uri.encodeComponent('${s['id']}')}'
                          '&className=${Uri.encodeComponent('${m['name']}')}'
                          '&sectionName=${Uri.encodeComponent('${s['name']}')}',
                        ),
                      ),
                  ],
                ),
              );
            }),
        ],
      ),
    );
  }
}
