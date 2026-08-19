import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../state/auth_state.dart';
import '../../state/parent_students_state.dart';
import '../../theme.dart';
import '../widgets/parent_child_dropdown.dart';

class ParentTcScreen extends StatefulWidget {
  const ParentTcScreen({super.key});

  @override
  State<ParentTcScreen> createState() => _ParentTcScreenState();
}

class _ParentTcScreenState extends State<ParentTcScreen> {
  final _reason = TextEditingController();
  List<dynamic> _requests = [];
  bool _loading = true;
  bool _submitting = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _reason.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final list = await context.read<AuthState>().api.parentTcRequests();
      if (!mounted) return;
      setState(() {
        _requests = list;
        _loading = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _error = e.toString();
        _loading = false;
      });
    }
  }

  Future<void> _submit() async {
    final child = context.read<ParentStudentsState>().selected;
    final id = child?['id']?.toString() ?? '';
    if (id.isEmpty) return;
    setState(() => _submitting = true);
    try {
      await context.read<AuthState>().api.createParentTcRequest(
            studentClassId: id,
            reason: _reason.text,
          );
      if (!mounted) return;
      _reason.clear();
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('TC request sent to the class teacher')),
      );
      await _load();
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e.toString())));
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  String _statusLabel(String status) {
    switch (status.toUpperCase()) {
      case 'REQUESTED':
        return 'With teacher';
      case 'FORWARDED':
        return 'With management';
      case 'APPROVED':
        return 'Approved — student inactive';
      case 'REJECTED':
        return 'Rejected';
      default:
        return status;
    }
  }

  @override
  Widget build(BuildContext context) {
    final students = context.watch<ParentStudentsState>();
    final child = students.selected;
    final name = child?['name']?.toString() ?? 'Student';

    return RefreshIndicator(
      onRefresh: _load,
      child: ListView(
        padding: const EdgeInsets.fromLTRB(16, 8, 16, 28),
        children: [
          const ParentChildDropdown(),
          const SizedBox(height: 8),
          const Text(
            'Request a Transfer Certificate. The class teacher notifies management. '
            'If approved, the student becomes inactive and is not deleted.',
            style: TextStyle(color: PresenceColors.muted, height: 1.4),
          ),
          const SizedBox(height: 16),
          TextField(
            controller: _reason,
            maxLines: 3,
            decoration: InputDecoration(
              labelText: 'Reason (optional)',
              hintText: 'Why are you requesting a TC for $name?',
              border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
            ),
          ),
          const SizedBox(height: 12),
          FilledButton.icon(
            onPressed: _submitting || child == null ? null : _submit,
            icon: _submitting
                ? const SizedBox(
                    width: 16,
                    height: 16,
                    child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                  )
                : const Icon(Icons.send_outlined),
            label: Text(_submitting ? 'Sending…' : 'Request TC'),
          ),
          const SizedBox(height: 24),
          const Text('Your requests', style: TextStyle(fontWeight: FontWeight.w800, fontSize: 16)),
          const SizedBox(height: 8),
          if (_loading)
            const Padding(
              padding: EdgeInsets.only(top: 24),
              child: Center(child: CircularProgressIndicator()),
            )
          else if (_error != null)
            Text(_error!, style: const TextStyle(color: PresenceColors.danger))
          else if (_requests.isEmpty)
            const Text('No TC requests yet.', style: TextStyle(color: PresenceColors.muted))
          else
            for (final raw in _requests)
              _RequestCard(
                request: Map<String, dynamic>.from(raw as Map),
                statusLabel: _statusLabel,
              ),
        ],
      ),
    );
  }
}

class _RequestCard extends StatelessWidget {
  const _RequestCard({required this.request, required this.statusLabel});
  final Map<String, dynamic> request;
  final String Function(String) statusLabel;

  @override
  Widget build(BuildContext context) {
    final status = request['status']?.toString() ?? '';
    return Card(
      margin: const EdgeInsets.only(bottom: 10),
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              request['studentName']?.toString() ?? 'Student',
              style: const TextStyle(fontWeight: FontWeight.w700),
            ),
            if ((request['classLabel']?.toString() ?? '').isNotEmpty)
              Text(
                request['classLabel'].toString(),
                style: const TextStyle(color: PresenceColors.muted, fontSize: 13),
              ),
            const SizedBox(height: 6),
            Text(
              statusLabel(status),
              style: const TextStyle(fontWeight: FontWeight.w600, color: PresenceColors.primaryDark),
            ),
            if ((request['reason']?.toString() ?? '').isNotEmpty) ...[
              const SizedBox(height: 6),
              Text(request['reason'].toString()),
            ],
          ],
        ),
      ),
    );
  }
}
