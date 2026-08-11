import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';

import '../../state/auth_state.dart';
import '../../theme.dart';
import 'widgets/notice_card.dart';

class StaffNoticeBoardScreen extends StatefulWidget {
  const StaffNoticeBoardScreen({super.key});

  @override
  State<StaffNoticeBoardScreen> createState() => _StaffNoticeBoardScreenState();
}

class _StaffNoticeBoardScreenState extends State<StaffNoticeBoardScreen> {
  List<dynamic> notices = [];
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
      final list = await context.read<AuthState>().api.listNotices();
      setState(() => notices = list);
    } catch (e) {
      setState(() => error = e.toString());
    } finally {
      if (mounted) setState(() => loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () async {
          final created = await context.push<bool>('/notices/compose');
          if (created == true) _load();
        },
        icon: const Icon(Icons.edit_outlined),
        label: const Text('Compose'),
      ),
      body: RefreshIndicator(
        onRefresh: _load,
        child: loading
            ? const Center(child: CircularProgressIndicator())
            : error != null
                ? ListView(
                    children: [
                      Padding(
                        padding: const EdgeInsets.all(24),
                        child: Text(error!, style: const TextStyle(color: PresenceColors.danger)),
                      ),
                    ],
                  )
                : notices.isEmpty
                    ? ListView(
                        children: const [
                          SizedBox(height: 80),
                          Center(child: Text('No notices yet. Tap Compose to send one.')),
                        ],
                      )
                    : ListView.separated(
                        padding: const EdgeInsets.only(bottom: 88, top: 8),
                        itemCount: notices.length,
                        separatorBuilder: (_, __) => const Divider(height: 1),
                        itemBuilder: (context, i) {
                          final m = Map<String, dynamic>.from(notices[i] as Map);
                          return NoticeCard(
                            audienceLabel: m['audienceLabel']?.toString() ?? 'Notice',
                            dateLabel: _fmt(m['date']?.toString() ?? m['createdOn']?.toString()),
                            body: m['body']?.toString() ?? '',
                            title: m['title']?.toString(),
                            attachmentName: m['attachmentName']?.toString(),
                          );
                        },
                      ),
      ),
    );
  }

  String _fmt(String? raw) {
    if (raw == null || raw.isEmpty) return '';
    try {
      return DateFormat('dd-MM-yyyy').format(DateTime.parse(raw));
    } catch (_) {
      return raw.length >= 10 ? raw.substring(0, 10) : raw;
    }
  }
}
