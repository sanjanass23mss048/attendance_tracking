import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../state/auth_state.dart';
import '../theme.dart';

class StudentsScreen extends StatefulWidget {
  const StudentsScreen({super.key});

  @override
  State<StudentsScreen> createState() => _StudentsScreenState();
}

class _StudentsScreenState extends State<StudentsScreen> {
  List<dynamic> students = [];
  bool loading = true;
  String? error;
  String query = '';

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
      final list = await context.read<AuthState>().api.students();
      setState(() => students = list);
    } catch (e) {
      setState(() => error = e.toString());
    } finally {
      if (mounted) setState(() => loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final filtered = students.where((s) {
      final m = Map<String, dynamic>.from(s as Map);
      final hay = '${m['name']} ${m['rollNo'] ?? m['roll']} ${m['className']} ${m['sectionName']}'
          .toLowerCase();
      return query.isEmpty || hay.contains(query.toLowerCase());
    }).toList();

    return Column(
      children: [
        Padding(
          padding: const EdgeInsets.all(12),
          child: TextField(
            decoration: const InputDecoration(
              prefixIcon: Icon(Icons.search),
              hintText: 'Search students',
            ),
            onChanged: (v) => setState(() => query = v),
          ),
        ),
        if (error != null)
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 12),
            child: Text(error!, style: const TextStyle(color: PresenceColors.danger)),
          ),
        Expanded(
          child: loading
              ? const Center(child: CircularProgressIndicator())
              : RefreshIndicator(
                  onRefresh: _load,
                  child: ListView.builder(
                    itemCount: filtered.length,
                    itemBuilder: (context, i) {
                      final m = Map<String, dynamic>.from(filtered[i] as Map);
                      return ListTile(
                        leading: CircleAvatar(
                          backgroundColor: PresenceColors.primarySoft,
                          child: Text('${m['rollNo'] ?? m['roll'] ?? '?'}',
                              style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w700)),
                        ),
                        title: Text('${m['name'] ?? ''}'),
                        subtitle: Text(
                          '${m['className'] ?? ''}-${m['sectionName'] ?? m['section'] ?? ''}',
                        ),
                      );
                    },
                  ),
                ),
        ),
      ],
    );
  }
}
