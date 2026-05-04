import 'dart:async';
import 'dart:convert';

import 'package:mqtt_client/mqtt_client.dart';
import 'package:mqtt_client/mqtt_server_client.dart';

import 'mqtt_config.dart';

class MqttClientService {
  final StreamController<bool> _connectionStateController =
      StreamController<bool>.broadcast();

  MqttServerClient? client;

  Stream<bool> get connectionStateStream => _connectionStateController.stream;

  bool get isConnected =>
      client?.connectionStatus?.state == MqttConnectionState.connected;

  Future<void> connect({Duration timeout = const Duration(seconds: 5)}) async {
    client = MqttServerClient(MqttConfig.broker, MqttConfig.clientId);
    client!.port = MqttConfig.port;

    client!.keepAlivePeriod = 20;
    client!.logging(on: true);
    client!.onConnected = _handleConnected;
    client!.onDisconnected = _handleDisconnected;

    final connMess = MqttConnectMessage()
        .withClientIdentifier(MqttConfig.clientId)
        .startClean();

    client!.connectionMessage = connMess;

    try {
      await client!.connect().timeout(timeout);
      print('MQTT Connected');
      _connectionStateController.add(true);
    } catch (e) {
      print('MQTT Connection failed: $e');
      _connectionStateController.add(false);
      client?.disconnect();
    }
  }

  void publish(String message) {
    if (!isConnected) {
      print('MQTT not connected; skipping publish');
      return;
    }

    final builder = MqttClientPayloadBuilder();
    builder.addString(message);

    client!.publishMessage(
      MqttConfig.topic,
      MqttQos.atLeastOnce,
      builder.payload!,
    );

    print('Message published: $message');
  }

  void subscribe({void Function(String message)? onMessage}) {
    if (!isConnected) {
      return;
    }

    client!.subscribe(MqttConfig.topic, MqttQos.atLeastOnce);

    final updates = client!.updates;
    if (updates == null) {
      return;
    }

    updates.listen((messages) {
      final recMess = messages[0].payload as MqttPublishMessage;
      final payloadBytes = recMess.payload.message;
      final payload = utf8.decode(payloadBytes);

      print('Received message: $payload');
      onMessage?.call(payload);
    });
  }

  void _handleConnected() {
    _connectionStateController.add(true);
  }

  void _handleDisconnected() {
    _connectionStateController.add(false);
  }

  void dispose() {
    client?.disconnect();
    _connectionStateController.close();
  }
}
