INSERT INTO sources (name, base_url, source_tier, permission_status, rights_status, enabled, configuration)
VALUES (
    'Looply seeded demo catalogue',
    'https://looply.local/seeded-catalogue',
    'inference',
    'approved_for_demo',
    'demo_only',
    FALSE,
    '{"ingestion_method":"manual_seed","display_policy":"demo"}'::jsonb
)
ON CONFLICT (name) DO NOTHING;

INSERT INTO compatibility_rules (name, rule_version, definition, explanation_template, review_status)
VALUES
    ('microphone_to_interface_xlr', 1, '{"from_signal":"microphone","to_signal":"microphone","connector":"XLR"}'::jsonb, 'Connect the microphone to a compatible XLR microphone input.', 'approved'),
    ('powered_monitor_line_output', 1, '{"from_signal":"line","to_signal":"line","requires_powered_monitor":true}'::jsonb, 'Connect powered monitors using compatible balanced line cables where available.', 'approved')
ON CONFLICT (name, rule_version) DO NOTHING;