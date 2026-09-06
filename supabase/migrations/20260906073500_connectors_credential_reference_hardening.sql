alter table public.connector_connections
  add constraint connector_connections_credential_reference_scheme_check
  check (
    credential_reference is null
    or credential_reference ~* '^(oauth|vault|secret)://[a-z0-9][a-z0-9/_:.-]{2,240}$'
  );

comment on column public.connector_connections.credential_reference is
  'Opaque reference to credentials resolved by the trusted runtime. Never stores the credential value itself.';
