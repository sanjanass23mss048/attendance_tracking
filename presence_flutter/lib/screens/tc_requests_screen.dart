import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../state/auth_state.dart';
import '../theme.dart';

class TcRequestsScreen extends StatefulWidget {
  const TcRequestsScreen({super.key});

  @override
  State<TcRequestsScreen> createState() => _TcRequestsScreenState();
}

class _TcRequestsScreenState extends State<TcRequestsScreen> {
  List<dynamic> _requests = [];
  bool _canReview = false;
  bool _loading = true;
  String? _error;
  String? _busyId;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final data = await context.read<AuthState>().api.listTcRequests();
      if (!mounted) return;
      setState(() {
        _requests = (data['requests'] as List?) ?? [];
        _canReview = data['canReview'] == true;
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

  Future<void> _run(String id, Future<void> Function() fn, String ok) async {
    setState(() => _busyId = id);
    try {
      await fn();
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(ok)));
      await _load();
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e.toString())));
    } finally {
      if (mounted) setState(() => _busyId = null);
    }
  }

  List<Map<String, dynamic>> _by(String status) {
    return _requests
        .map((e) => Map<String, dynamic>.from(e as Map))
        .where((r) => (r['status']?.toString() ?? '') == status)
        .toList();
  }

  @override
  Widget build(BuildContext context) {
    final api = context.read<AuthState>().api;
    if (_loading) return const Center(child: CircularProgressIndicator());
    if (_error != null) {
      return Center(child: Text(_error!, style: const TextStyle(color: PresenceColors.danger)));
    }

    return RefreshIndicator(
      onRefresh: _load,
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          const Text(
            'Parent requests a TC → teacher notifies management → management approves. '
            'The student is set inactive and is not deleted.',
            style: TextStyle(color: PresenceColors.muted, height: 1.4),
          ),
          const SizedBox(height: 16),
          _Section(
            title: 'Waiting on teacher',
            empty: 'No parent TC requests waiting.',
            items: _by('REQUESTED'),
            busyId: _busyId,
            actionLabel: 'Notify management',
            onAction: (id) => _run(
              id,
              () async {
                await api.forwardTcRequest(id);
              },
              'Management notified',
            ),
          ),
          _Section(
            title: _canReview ? 'Waiting on management' : 'Sent to management',
            empty: 'Nothing waiting for management.',
            items: _by('FORWARDED'),
            busyId: _busyId,
            canReview: _canReview,
            onApprove: (id) => _run(
              id,
              () async {
                await api.approveTcRequest(id);
              },
              'Approved — student inactive',
            ),
            onReject: (id) => _run(
              id,
              () async {
                await api.rejectTcRequest(id);
              },
              'TC request rejected',
            ),
          ),
          _Section(
            title: 'History',
            empty: 'No completed requests yet.',
            items: [
              ..._by('APPROVED'),
              ..._by('REJECTED'),
            ],
            busyId: _busyId,
          ),
        ],
      ),
    );
  }
}

class _Section extends StatelessWidget {
  const _Section({
    required this.title,
    required this.empty,
    required this.items,
    required this.busyId,
    this.actionLabel,
    this.onAction,
    this.canReview = false,
    this.onApprove,
    this.onReject,
  });

  final String title;
  final String empty;
  final List<Map<String, dynamic>> items;
  final String? busyId;
  final String? actionLabel;
  final Future<void> Function(String id)? onAction;
  final bool canReview;
  final Future<void> Function(String id)? onApprove;
  final Future<void> Function(String id)? onReject;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 18),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(title, style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 15)),
          const SizedBox(height: 8),
          if (items.isEmpty)
            Text(empty, style: const TextStyle(color: PresenceColors.muted))
          else
            for (final req in items)
              Card(
                margin: const EdgeInsets.only(bottom: 8),
                child: Padding(
                  padding: const EdgeInsets.all(12),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        req['studentName']?.toString() ?? 'Student',
                        style: const TextStyle(fontWeight: FontWeight.w700),
                      ),
                      Text(
                        req['classLabel']?.toString() ?? '',
                        style: const TextStyle(color: PresenceColors.muted, fontSize: 13),
                      ),
                      if ((req['reason']?.toString() ?? '').isNotEmpty)
                        Padding(
                          padding: const EdgeInsets.only(top: 6),
                          child: Text(req['reason'].toString()),
                        ),
                      const SizedBox(height: 10),
                      Wrap(
                        spacing: 8,
                        children: [
                          if (onAction != null)
                            FilledButton(
                              onPressed: busyId == req['id']
                                  ? null
                                  : () => onAction!(req['id'].toString()),
                              child: Text(actionLabel ?? 'Action'),
                            ),
                          if (canReview) ...[
                            FilledButton(
                              onPressed: busyId == req['id']
                                  ? null
                                  : () => onApprove!(req['id'].toString()),
                              child: const Text('Approve'),
                            ),
                            OutlinedButton(
                              onPressed: busyId == req['id']
                                  ? null
                                  : () => onReject!(req['id'].toString()),
                              child: const Text('Reject'),
                            ),
                          ],
                        ],
                      ),
                    ],
                  ),
                ),
              ),
        ],
      ),
    );
  }
}
