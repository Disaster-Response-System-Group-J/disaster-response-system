import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  testWidgets('renders a basic Material smoke screen', (tester) async {
    await tester.pumpWidget(
      const MaterialApp(
        home: Scaffold(
          body: Text('J1 Disaster Response'),
        ),
      ),
    );

    expect(find.text('J1 Disaster Response'), findsOneWidget);
  });
}
