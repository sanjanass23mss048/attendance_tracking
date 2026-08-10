import 'package:flutter_test/flutter_test.dart';
import 'package:presence_app/api/api_client.dart';
import 'package:presence_app/main.dart';

void main() {
  testWidgets('Presence app boots', (WidgetTester tester) async {
    await tester.pumpWidget(PresenceApp(client: ApiClient()));
    await tester.pump();
    expect(find.byType(PresenceApp), findsOneWidget);
  });
}
