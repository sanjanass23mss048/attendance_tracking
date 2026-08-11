import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';

import '../../state/auth_state.dart';
import '../../theme.dart';

class ParentProfileScreen extends StatefulWidget {
  const ParentProfileScreen({super.key});

  @override
  State<ParentProfileScreen> createState() => _ParentProfileScreenState();
}

class _ParentProfileScreenState extends State<ParentProfileScreen> {
  List<dynamic> children = [];
  bool loading = true;
  String? error;
  int selected = 0;

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
      final list = await context.read<AuthState>().api.parentChildren();
      setState(() {
        children = list;
        if (selected >= list.length) selected = 0;
      });
    } catch (e) {
      setState(() => error = e.toString());
    } finally {
      if (mounted) setState(() => loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    if (loading) return const Center(child: CircularProgressIndicator());
    if (error != null) {
      return Center(child: Text(error!, style: const TextStyle(color: PresenceColors.danger)));
    }
    if (children.isEmpty) {
      return const Center(child: Text('No linked student profile.'));
    }

    final child = Map<String, dynamic>.from(children[selected] as Map);
    final section = child['section'] is Map ? Map<String, dynamic>.from(child['section'] as Map) : null;
    final className = section?['class'] is Map
        ? (section!['class'] as Map)['name']?.toString()
        : null;
    final sectionName = section?['name']?.toString();

    return RefreshIndicator(
      onRefresh: _load,
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          if (children.length > 1) ...[
            const Text('Select student', style: TextStyle(fontWeight: FontWeight.w600)),
            const SizedBox(height: 8),
            Wrap(
              spacing: 8,
              children: [
                for (var i = 0; i < children.length; i++)
                  ChoiceChip(
                    label: Text((children[i] as Map)['name']?.toString() ?? 'Student'),
                    selected: selected == i,
                    onSelected: (_) => setState(() => selected = i),
                  ),
              ],
            ),
            const SizedBox(height: 16),
          ],
          Card(
            child: Padding(
              padding: const EdgeInsets.all(20),
              child: Column(
                children: [
                  CircleAvatar(
                    radius: 36,
                    backgroundColor: PresenceColors.primarySoft,
                    child: Text(
                      _initials(child['name']?.toString()),
                      style: const TextStyle(
                        fontSize: 24,
                        fontWeight: FontWeight.w800,
                        color: PresenceColors.primaryDark,
                      ),
                    ),
                  ),
                  const SizedBox(height: 12),
                  Text(
                    child['name']?.toString() ?? 'Student',
                    style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w800),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    [
                      if (className != null && sectionName != null) 'Class $className - $sectionName',
                      if (child['rollNo'] != null) 'Roll ${child['rollNo']}',
                    ].join(' · '),
                    style: const TextStyle(color: PresenceColors.muted),
                  ),
                ],
              ),
            ),
          ),
          const SizedBox(height: 12),
          _infoCard('Admission No', child['admissionNo']?.toString()),
          _infoCard('Date of birth', _fmtDob(child['dob']?.toString())),
          _infoCard('Gender', child['gender']?.toString()),
          _infoCard('Father', child['fatherName']?.toString() ?? child['fatherName']?.toString()),
          _infoCard('Mother', child['motherName']?.toString()),
          _infoCard('Parent phone', child['parentPhone']?.toString() ?? child['fatherPhone']?.toString()),
          _infoCard('Address', child['address']?.toString()),
          _infoCard('Status', child['status']?.toString()),
        ],
      ),
    );
  }

  Widget _infoCard(String label, String? value) {
    if (value == null || value.trim().isEmpty) return const SizedBox.shrink();
    return Card(
      margin: const EdgeInsets.only(bottom: 8),
      child: ListTile(
        title: Text(label, style: const TextStyle(fontSize: 12, color: PresenceColors.muted)),
        subtitle: Text(value, style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 15)),
      ),
    );
  }

  String _initials(String? name) {
    final parts = (name ?? '').trim().split(RegExp(r'\s+'));
    if (parts.isEmpty || parts.first.isEmpty) return '?';
    if (parts.length == 1) return parts.first[0].toUpperCase();
    return (parts.first[0] + parts.last[0]).toUpperCase();
  }

  String? _fmtDob(String? raw) {
    if (raw == null || raw.isEmpty) return null;
    try {
      return DateFormat('dd MMM yyyy').format(DateTime.parse(raw));
    } catch (_) {
      return raw;
    }
  }
}
